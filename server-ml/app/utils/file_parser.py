import pandas as pd
from fastapi import UploadFile


ALLOWED_EXTENSIONS = (".csv", ".xlsx", ".xls")


async def parse_uploaded_file(file: UploadFile) -> pd.DataFrame:
    filename = file.filename or ""
    lower_filename = filename.lower()

    if not lower_filename.endswith(ALLOWED_EXTENSIONS):
        raise ValueError("Unsupported file type. Only CSV, XLSX, and XLS files are allowed.")

    if lower_filename.endswith(".csv"):
        return pd.read_csv(file.file)

    return pd.read_excel(file.file)
