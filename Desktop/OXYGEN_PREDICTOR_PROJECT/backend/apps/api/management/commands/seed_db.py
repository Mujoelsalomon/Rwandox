import os
from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
    help = "Seed database by executing a SQL file"

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True, help="Path to SQL file to execute")

    def handle(self, *args, **options):
        path = options["file"]
        if not os.path.exists(path):
            self.stderr.write(f"SQL file not found: {path}")
            return

        sql_text = open(path, "r", encoding="utf-8").read()

        # Split into statements conservatively; ignore comment lines
        statements = []
        cur = []
        for line in sql_text.splitlines():
            s = line.strip()
            if not s or s.startswith("--"):
                continue
            cur.append(line)
            if s.endswith(";"):
                stmt = "\n".join(cur).rstrip(";").strip()
                if stmt:
                    statements.append(stmt)
                cur = []
        if cur:
            statements.append("\n".join(cur).strip())

        self.stdout.write(f"Executing {len(statements)} SQL statements from {path}")

        with transaction.atomic(), connection.cursor() as cursor:
            for i, stmt in enumerate(statements, start=1):
                try:
                    cursor.execute(stmt)
                    self.stdout.write(self.style.SUCCESS(f"[{i}] OK"))
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"[{i}] FAILED: {e}"))

        self.stdout.write(self.style.SUCCESS("Seeding completed"))
