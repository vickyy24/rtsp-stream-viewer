import uuid
import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
from django.conf import settings
from django.db import models


def _url_cipher():
    key = settings.CAMERA_URL_ENCRYPTION_KEY
    if not key:
        raise RuntimeError("CAMERA_URL_ENCRYPTION_KEY must be configured.")
    return AESGCM(hashlib.sha256(key.encode("utf-8")).digest())


class Camera(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="cameras",
    )
    name = models.CharField(max_length=120)
    location = models.CharField(max_length=160, blank=True)
    host = models.CharField(max_length=253)
    encrypted_url = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def create_with_url(cls, *, name, location, host, url):
        camera = cls(name=name, location=location, host=host)
        camera.set_stream_url(url)
        camera.save()
        return camera

    def set_stream_url(self, url):
        nonce = os.urandom(12)
        ciphertext = _url_cipher().encrypt(nonce, url.encode("utf-8"), None)
        self.encrypted_url = base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")

    def get_stream_url(self):
        try:
            encrypted = base64.urlsafe_b64decode(self.encrypted_url.encode("ascii"))
            return _url_cipher().decrypt(encrypted[:12], encrypted[12:], None).decode("utf-8")
        except (InvalidTag, ValueError, UnicodeDecodeError) as error:
            raise ValueError("The saved camera URL could not be decrypted.") from error

    def public_data(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "location": self.location,
            "host": self.host,
            "created_at": self.created_at.isoformat(),
        }
