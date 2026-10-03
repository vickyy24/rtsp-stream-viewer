from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.db.models.functions import Lower


class EmailUserManager(UserManager):
    def normalize_email(self, email):
        return super().normalize_email(email.strip()).lower() if email else email

    def get_by_natural_key(self, username):
        return self.get(**{self.model.USERNAME_FIELD: username.strip().lower()})


class User(AbstractUser):
    username = None
    email = models.EmailField("email address", unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = EmailUserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)
