from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class TokenEncryptionError(Exception):
    pass


def _get_fernet() -> Fernet:
    key = get_settings().token_encryption_key
    if not key:
        raise TokenEncryptionError(
            "TOKEN_ENCRYPTION_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
            "and add it to your .env file."
        )
    return Fernet(key.encode())


def encrypt_token(raw_token: str) -> str:
    return _get_fernet().encrypt(raw_token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    try:
        return _get_fernet().decrypt(encrypted_token.encode()).decode()
    except InvalidToken as exc:
        raise TokenEncryptionError("Stored GitHub token could not be decrypted; it may be corrupt.") from exc
