import os

import django
import pytest
from django.test.utils import setup_databases, setup_test_environment, teardown_databases, teardown_test_environment


def pytest_configure(config):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend_project.settings")
    django.setup()
    setup_test_environment()


@pytest.fixture(scope="session", autouse=True)
def django_test_databases(request):
    old_config = setup_databases(verbosity=0, interactive=False)

    def teardown():
        teardown_databases(old_config, verbosity=0)
        teardown_test_environment()

    request.addfinalizer(teardown)
