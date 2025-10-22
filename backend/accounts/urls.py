from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import me, users, create_user, update_user_status, reset_password, school_me, update_user, change_password, school_info, trial_signup, verify_email, logout, logout_all, school_public, school_teachers_public, teacher_public_detail

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', logout, name='logout'),
    path('logout-all/', logout_all, name='logout_all'),
    path('me/', me, name='me'),
    path('users/', users, name='users'),
    path('users/create/', create_user, name='users-create'),
    path('users/update/', update_user, name='users-update'),
    path('users/status/', update_user_status, name='users-status'),
    path('users/reset_password/', reset_password, name='users-reset-password'),
    path('users/change_password/', change_password, name='users-change-password'),
    path('school/me/', school_me, name='school-me'),
    path('school/info/', school_info, name='school-info'),
    path('school/public/', school_public, name='school-public'),
    path('school/teachers/', school_teachers_public, name='school-teachers-public'),
    path('school/teachers/<int:id>/', teacher_public_detail, name='teacher-public-detail'),
    path('trial-signup/', trial_signup, name='trial-signup'),
    path('verify-email/', verify_email, name='verify-email'),
]
