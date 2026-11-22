from django.urls import path

from . import views

urlpatterns = [
    path('landlord/state/', views.landlord_state_view),
    path('landlord/consent/', views.landlord_consent),
    path('landlord/properties/', views.add_property),
    path('landlord/units/<str:unit_key>/', views.update_unit),
    path('landlord/units/<str:unit_key>/tenant/', views.unit_tenant),
    path('landlord/units/<str:unit_key>/baseline/', views.save_baseline),
    path('landlord/units/<str:unit_key>/areas/rename/', views.rename_area),
    path('landlord/units/<str:unit_key>/inspections/', views.schedule_inspection),
    path('landlord/inspections/<str:inspection_key>/', views.cancel_inspection),
    path('landlord/inspections/<str:inspection_key>/confirm/', views.confirm_time),
    path('landlord/inspections/<str:inspection_key>/review/', views.rerun_review),
    path('tenant/state/', views.tenant_state_view),
    path('tenant/progress/', views.tenant_progress),
    path('tenant/invite/accept/', views.accept_invite),
    path('tenant/invite/decline/', views.decline_invite),
    path('tenant/inspections/<str:inspection_key>/availability/', views.send_availability),
    path('tenant/inspections/<str:inspection_key>/submit/', views.submit_inspection),
    path('photos/', views.upload),
]
