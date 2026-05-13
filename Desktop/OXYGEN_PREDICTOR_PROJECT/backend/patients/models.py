from django.db import models

class Patient(models.Model):
    name = models.CharField(max_length=200)
    age = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.age})"
