from boto3 import client
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import os

# Initialize the FastAPI application
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap the app with Mangum to enable Lambda compatibility
handler = Mangum(app)

# Define a simple GET endpoint
@app.get("/")
async def hello_world():
    BUCKET = os.environ["s3_storage_bucket"]
    
    result = get_all_json_notes_in_directory(bucket=BUCKET, prefix="") 
    return result


def get_all_json_notes_in_directory(bucket: str, prefix: str = "") -> dict:
    notes = []
    continuation_token = None
    
    s3client = client('s3',
                    aws_access_key_id=os.environ["aws_access_key_id"],
                    aws_secret_access_key=os.environ["aws_secret_access_key"]
                    )

    while True:
        params = {
            "Bucket": bucket,
            "Prefix": prefix,
            "MaxKeys": 1000,
        }
        if continuation_token:
            params["ContinuationToken"] = continuation_token

        response = s3client.list_objects_v2(**params)

        for item in response.get("Contents", []):
            key = item["Key"]

            if not key.lower().endswith(".json"):
                continue

            try:
                obj = s3client.get_object(Bucket=bucket, Key=key)
                body = obj["Body"].read().decode("utf-8")
                parsed = json.loads(body)
                notes.append(parsed)

            except json.JSONDecodeError as error:
                raise RuntimeError(
                    f"Invalid JSON in s3://{bucket}/{key}"
                ) from error

        if response.get("IsTruncated"):
            continuation_token = response["NextContinuationToken"]
        else:
            break

    return {"notes": notes}