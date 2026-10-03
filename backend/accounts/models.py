from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.db.models.functions import Lower


class EmailUserManager(models.Manager):
    def create_user(self, email, password):
        email = email.strip().lower()
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=email)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def get_by_natural_key(self, email):
        return self.get(**{self.model.USERNAME_FIELD: email.strip().lower()})


class User(models.Model):
    id = models.BigAutoField(primary_key=True)
    full_name = models.CharField(max_length=150, default="")
    email = models.EmailField(max_length=254)
    password = models.CharField(max_length=128)

    USERNAME_FIELD = "email"
    objects = EmailUserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    @property
    def is_authenticated(self):
        return True

    def __str__(self):
        return self.email
