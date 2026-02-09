import json
import os
import boto3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later to your CloudFront domain
    allow_methods=["*"],
    allow_headers=["*"],
)

s3 = boto3.client("s3")


def get_all_json_notes_in_directory(bucket: str, prefix: str = "") -> dict:
    notes = []
    token = None

    while True:
        params = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
        if token:
            params["ContinuationToken"] = token

        resp = s3.list_objects_v2(**params)

        for item in resp.get("Contents", []):
            key = item["Key"]
            if not key.lower().endswith(".json"):
                continue

            obj = s3.get_object(Bucket=bucket, Key=key)
            body = obj["Body"].read().decode("utf-8")
            notes.append(json.loads(body))

        if resp.get("IsTruncated"):
            token = resp["NextContinuationToken"]
        else:
            break

    return {"notes": notes}


@app.get("/")
async def root():
    bucket = os.environ["s3_storage_bucket"]
    return get_all_json_notes_in_directory(bucket=bucket, prefix="")


# IMPORTANT: define this LAST
handler = Mangum(app)
