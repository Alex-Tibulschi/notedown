import json
import os
import boto3
from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel
from typing import Optional
import uuid
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later to your CloudFront domain
    allow_methods=["*"],
    allow_headers=["*"],
)

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

NOTES_BUCKET = os.environ["s3_storage_bucket"]
NOTES_TABLE = os.environ["dynamodb_table"]

table = dynamodb.Table(NOTES_TABLE) # type: ignore

""" --- Authorization --- """
def get_cognito_claims(request: Request) -> dict:
    # Extracts and returns the Cognito claims from the request object
    event = request.scope.get("aws.event") or {}
    rc = event.get("requestContext") or {}
    auth = rc.get("authorizer") or {}

    claims = auth.get("claims") or {}
    if claims:
        return claims

    raise HTTPException(status_code=401, detail="Missing/invalid authorizer claims")

def get_user_sub(request: Request) -> str:
    claims = get_cognito_claims(request)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Missing sub claim")
    return sub
class Note(BaseModel):
    title: str
    user_id: str
    content: dict    

def get_all_notes(table, s3, user_id: str | None = None, page_size: int = 10) -> dict:
    notes = []
    last_key = None

    while True:
        kwargs = {"Limit": page_size}
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key

        resp = table.scan(**kwargs)
        items = resp.get("Items", [])

        if user_id is not None:
            items = [it for it in items if it.get("user_id") == user_id]

        for meta in items:
            bucket = meta["s3_bucket"]
            key = meta["s3_key"]

            try:
                obj = s3.get_object(Bucket=bucket, Key=key)
                content = json.loads(obj["Body"].read().decode("utf-8"))
            except ClientError as e:
                content = {"_error": f"S3 get_object failed: {e.response.get('Error', {}).get('Code', 'Unknown')}"}
            except json.JSONDecodeError:
                content = {"_error": "Invalid JSON in S3 object"}

            notes.append({**meta, "content": content})

        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break

    return {"notes": notes}


@app.get("/notes")
async def root(request: Request):
    user_sub = get_user_sub(request)
    print("Notes Loading...")
    return get_all_notes(table=table, s3=s3, user_id=user_sub)

@app.post("/notes")
def create_note(note: Note):
    updated_at = int(time.time())
    note_id = f'{updated_at}#{uuid.uuid4().hex}'
    
    s3_key = f'notes/{note.user_id}/{note_id}.json'
    
    try:
        s3.put_object(
            Bucket= NOTES_BUCKET,
            Key= s3_key,
            Body= json.dumps(note.content, separators=(',', ':'), ensure_ascii=False).encode("utf-8"),
            ContentType= "application/json"
        )
    except ClientError as error:
        raise HTTPException(status_code=502, detail=f"S3 put_object failed: {error.response.get('Error', {}).get('Message', str(error))}")

    
    item = {
        "note_id": note_id,
        "title": note.title,
        "user_id": note.user_id,
        "s3_bucket": NOTES_BUCKET,
        "s3_key": s3_key,
        "content_type": ["json"],
        "updated_at": updated_at
    }
    
    try:
        table.put_item(
            Item= item,
            ConditionExpression= "attribute_not_exists(note_id)"
        )
    except ClientError as error:
        raise HTTPException(status_code=502, detail=f"DynamoDB put_item failed: {error.response.get('Error', {}).get('Message', str(error))}")
    
    print(f'Posted Note Id: {note_id}')
    
    return {
        "note_id": note_id,
        "s3_bucket": NOTES_BUCKET,
        "s3_key": s3_key,
        "s3_uri": f"s3://{NOTES_BUCKET}/{s3_key}",
        "updated_at": updated_at
        
    }
    
# IMPORTANT: define this LAST
handler = Mangum(app)
