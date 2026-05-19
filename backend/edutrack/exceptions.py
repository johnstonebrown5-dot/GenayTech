from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging
import time

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler to provide better error responses and logging
    for broken pipe and timeout errors.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Log the exception with context
        request = context.get('request')
        view = context.get('view')
        
        logger.error(
            f"API Error: {exc.__class__.__name__} - {str(exc)} | "
            f"View: {view.__class__.__name__ if view else 'Unknown'} | "
            f"Path: {request.path if request else 'Unknown'} | "
            f"Method: {request.method if request else 'Unknown'} | "
            f"User: {request.user if request and hasattr(request, 'user') else 'Anonymous'}"
        )

        # Customize error response
        custom_response_data = {
            'error': True,
            'status_code': response.status_code,
            'detail': str(exc),
            'timestamp': time.time(),
        }

        # Add specific handling for common errors
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            custom_response_data['detail'] = 'Authentication required. Please log in again.'
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            custom_response_data['detail'] = 'You do not have permission to perform this action.'
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            custom_response_data['detail'] = 'The requested resource was not found.'
        elif response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR:
            custom_response_data['detail'] = 'An internal server error occurred. Please try again later.'

        response.data = custom_response_data

    return response
