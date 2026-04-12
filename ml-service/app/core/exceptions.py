from fastapi import HTTPException, status


class AudioValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class AudioDownloadError(HTTPException):
    def __init__(self, detail: str = "No se pudo descargar el archivo de audio"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ModelNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Modelo ML no disponible. Entrene o cargue un modelo primero.",
        )


class TranscriptionError(HTTPException):
    def __init__(self, detail: str = "Error durante la transcripción de audio"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)
