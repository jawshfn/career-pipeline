import hashlib
import re
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile, status


MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024
PDF_MEDIA_TYPE = "application/pdf"
PDF_EXTENSION = ".pdf"
PDF_SIGNATURE = b"%PDF-"
READ_CHUNK_SIZE = 64 * 1024
_CONTROL_CHARACTER_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


@dataclass(frozen=True)
class ValidatedResumeFile:
    original_filename: str
    content: bytes
    size_bytes: int
    sha256: str


def sanitize_filename(filename: str | None) -> str:
    if filename is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A PDF filename is required.")
    basename = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not basename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A PDF filename is required.")
    if _CONTROL_CHARACTER_PATTERN.search(basename):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The PDF filename contains unsupported characters.")
    if len(basename) > 255:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The PDF filename must be 255 characters or fewer.")
    if not basename.lower().endswith(PDF_EXTENSION):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded filename must end in .pdf.")
    return basename


async def validate_upload(upload: UploadFile) -> ValidatedResumeFile:
    filename = sanitize_filename(upload.filename)
    if upload.content_type != PDF_MEDIA_TYPE:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only application/pdf uploads are supported.")

    chunks: list[bytes] = []
    size_bytes = 0
    while True:
        chunk = await upload.read(min(READ_CHUNK_SIZE, MAX_PDF_SIZE_BYTES + 1 - size_bytes))
        if not chunk:
            break
        size_bytes += len(chunk)
        if size_bytes > MAX_PDF_SIZE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The PDF exceeds the 5 MiB size limit.")
        chunks.append(chunk)

    content = b"".join(chunks)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The PDF file must not be empty.")
    if not content.startswith(PDF_SIGNATURE):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded content is not a PDF.")
    return ValidatedResumeFile(
        original_filename=filename,
        content=content,
        size_bytes=size_bytes,
        sha256=hashlib.sha256(content).hexdigest(),
    )


def content_disposition(filename: str) -> str:
    """Build a safe inline Content-Disposition value with RFC 5987 Unicode support."""
    ascii_fallback = "".join(character if 32 <= ord(character) < 127 and character not in {'\\', '"'} else "_" for character in filename)
    ascii_fallback = ascii_fallback or "resume.pdf"
    from urllib.parse import quote

    return f"inline; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"
