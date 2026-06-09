from rest_framework.authentication import SessionAuthentication

from apps.api.common import development_header_user


class SessionOrDevelopmentHeaderAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return None

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if authenticated:
            return authenticated

        user = development_header_user(request._request)
        if user is not None:
            return (user, None)
        return None
