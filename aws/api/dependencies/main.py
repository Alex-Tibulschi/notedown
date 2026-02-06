from boto3 import client
import json
from fastapi import FastAPI
from mangum import Mangum

# Initialize the FastAPI application
app = FastAPI()
# Wrap the app with Mangum to enable Lambda compatibility
handler = Mangum(app)

# Define a simple GET endpoint
@app.get("/")
async def hello_world():
    BUCKET = 'notedown-storage'
    FILE_TO_READ = 'test-note.json'
    s3client = client('s3',
                    aws_access_key_id='AKIA3NDOYXMRCOENAX7V',
                    aws_secret_access_key='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'
                    )
    result = s3client.get_object(Bucket=BUCKET, Key=FILE_TO_READ) 
    text = json.loads(result["Body"].read().decode())
    return text