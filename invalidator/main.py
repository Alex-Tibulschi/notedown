import boto3
import time
import os

cloudfront = boto3.client("cloudfront")

def lambda_handler(event, context):
    print("Event:", event)
    
    distribution_id = os.environ["DISTRIBUTION_ID"]
    
    paths = ["/*"]
    
    caller_reference = f'{int(time.time() * 1000)}'
    
    response = cloudfront.create_invalidation(
        DistributionId= distribution_id,
        InvalidationBatch={
            "Paths" : {
                "Quantity" : len(paths),
                "Items" : paths
            },
            "CallerReference" : caller_reference
        }
    )
    
    return {
        'statusCode': 200,
        'InvalidationId': response["Invalidation"]["Id"],
        'status': response["Invalidation"]["Status"],
        'paths': paths
    }
