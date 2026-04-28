from fastapi import HTTPException, status

class ResourceNotFoundError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class ValidationFailedError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class ConflictError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)

class UnauthorizedError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

class UnauthenticatedError(HTTPException):
    def __init__(self, detail: str, headers: dict = None):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=detail, 
            headers=headers
        )
