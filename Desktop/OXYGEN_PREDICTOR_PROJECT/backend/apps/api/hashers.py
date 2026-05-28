import os

from django.contrib.auth.hashers import PBKDF2PasswordHasher


class FastLoginPBKDF2PasswordHasher(PBKDF2PasswordHasher):
    iterations = int(os.getenv("FAST_LOGIN_PBKDF2_ITERATIONS", "120000"))
