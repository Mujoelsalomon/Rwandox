import re

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    user_code = models.CharField(max_length=50, unique=True)
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user_code


def ensure_user_profile(user):
    try:
        return user.profile
    except ObjectDoesNotExist:
        pass

    return UserProfile.objects.create(user=user, user_code=next_user_code())


def next_user_code():
    codes = UserProfile.objects.filter(user_code__startswith="OX").values_list("user_code", flat=True)
    highest = 0
    for code in codes:
        match = re.fullmatch(r"OX(\d+)", str(code).strip())
        if match:
            highest = max(highest, int(match.group(1)))
    return f"OX{highest + 1:03d}"
