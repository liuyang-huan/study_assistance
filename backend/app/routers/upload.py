import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File

router = APIRouter(prefix='/api/upload', tags=['upload'])

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/gif', 'image/webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024

_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / 'data' / 'uploads' / 'images'


@router.post('/image')
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f'不支持的图片格式: {file.content_type}')

    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f'不支持的文件扩展名: {ext}')

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, '图片大小不能超过 10MB')

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    unique_name = f'{uuid.uuid4().hex}{ext}'
    dest = _UPLOAD_DIR / unique_name
    dest.write_bytes(content)

    return {'url': f'/uploads/images/{unique_name}'}
