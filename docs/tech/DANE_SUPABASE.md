# Dane w Supabase (projekt fqhvxhnbeyvwubpnuzxe)

> Plik generowany skryptem z kodu (docs/tech/generuj.mjs) — po zmianach uruchom ponownie: `node docs/tech/generuj.mjs`.

Tabele i funkcje SQL wykryte w kodzie serwera. Dostęp: funkcje Base44 łączą się przez łącznik Supabase (Management API, `runSql`) albo przez PostgREST RPC z kluczem service_role pobieranym w locie (`rpc`) — patrz base44/shared/supabase.ts. Schematy tworzą/aktualizują pliki *Schema.ts / *Sql.ts.

## Tabele

| Tabela | Używana w |
|---|---|
| app_settings | base44/functions/emailChange, base44/functions/eventsPublic, base44/shared/libraryRpcSql.ts, base44/shared/settings.ts |
| bk_answers | base44/shared/bookingSchema.ts, base44/shared/gdpr.ts |
| bk_backup_20261011_events | base44/shared/bookingSchema.ts |
| bk_backup_20261011_registrations | base44/shared/bookingSchema.ts |
| bk_blocks | base44/functions/bookingAdmin, base44/shared/bookingIcal.ts, base44/shared/bookingSchema.ts |
| bk_bookings | base44/functions/bookingAdmin, base44/functions/bookingPublic, base44/shared/bookingGoogle.ts, base44/shared/bookingIcal.ts, base44/shared/bookingNotify.ts, base44/shared/bookingSchema.ts |
| bk_consents | base44/shared/bookingSchema.ts |
| bk_gcal_queue | base44/shared/bookingGoogle.ts, base44/shared/bookingSchema.ts |
| bk_holidays | base44/functions/bookingAdmin, base44/shared/bookingSchema.ts |
| bk_hours | base44/functions/bookingAdmin, base44/shared/bookingSchema.ts |
| bk_log | base44/functions/bookingAdmin, base44/shared/bookingSchema.ts |
| bk_notifications | base44/shared/bookingNotify.ts, base44/shared/bookingSchema.ts |
| bk_packages | base44/functions/bookingPublic, base44/shared/bookingSchema.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| bk_rate | base44/shared/bookingSchema.ts |
| bk_settings | base44/functions/bookingAdmin, base44/functions/bookingPublic, base44/functions/payuNotification, base44/shared/booking.ts, base44/shared/bookingGoogle.ts, base44/shared/bookingIcal.ts, base44/shared/bookingNotify.ts, base44/shared/bookingSchema.ts |
| bk_tokens | base44/shared/bookingNotify.ts, base44/shared/bookingSchema.ts |
| bk_types | base44/functions/bookingAdmin, base44/functions/bookingPublic, base44/functions/libraryAdmin, base44/shared/bookingGoogle.ts, base44/shared/bookingIcal.ts, base44/shared/bookingNotify.ts, base44/shared/bookingSchema.ts |
| campaign_recipients | base44/functions/adminNewsletter |
| campaigns | base44/functions/adminNewsletter |
| contact_messages | base44/functions/adminDashboard, base44/functions/createContactMessage |
| events | base44/functions/adminDashboard, base44/functions/announcements, base44/functions/eventShare, base44/functions/eventsAdmin, base44/functions/eventsCancel, base44/functions/eventsPublic, base44/functions/myEvents, base44/functions/sitemap, base44/shared/bookingSchema.ts, base44/shared/publicData.ts, base44/shared/registrations.ts |
| mb_assignments | base44/functions/libraryAdmin, base44/shared/library2bSql.ts, base44/shared/libraryNotify.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_collection_items | base44/functions/libraryAdmin, base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_collections | base44/functions/libraryAdmin, base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_group_members | base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_groups | base44/functions/libraryAdmin, base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_log | base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_material_state | base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_materials | base44/functions/libraryAdmin, base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_message_attachments | base44/shared/library2bSql.ts |
| mb_message_recipients | base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_messages | base44/functions/libraryTick, base44/shared/gdpr.ts, base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_rate | base44/shared/librarySchema.ts |
| mb_settings | base44/functions/libraryAdmin, base44/functions/libraryTick, base44/shared/library2bSql.ts, base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| mb_templates | base44/shared/libraryRpcSql.ts, base44/shared/librarySchema.ts |
| newsletter_groups | base44/functions/adminNewsletter |
| orders | base44/functions/adminDashboard, base44/functions/adminOrders, base44/functions/emailChange, base44/functions/myAccount, base44/shared/librarySchema.ts, base44/shared/orders.ts |
| page_content | base44/functions/adminContent, base44/shared/publicData.ts |
| podcast_applications | base44/functions/adminDashboard |
| powrot_applications | base44/functions/adminDashboard, base44/functions/createPowrotApplication, base44/functions/gdprPerson, base44/shared/retention.ts |
| product_price_daily | base44/shared/productPrice.ts |
| products | base44/functions/adminClients, base44/functions/adminDashboard, base44/functions/adminOrders, base44/functions/adminProducts, base44/functions/bookingAdmin, base44/functions/checkDiscount, base44/functions/libraryAdmin, base44/functions/myAccount, base44/functions/orderFree, base44/functions/payuCreateOrder, base44/functions/payuNotification, base44/functions/shopProducts, base44/functions/shopQuizSubmit, base44/functions/shopWaitlist, base44/functions/sitemap, base44/shared/productPrice.ts |
| quiz_result | base44/functions/adminQuiz, base44/functions/shopQuizSubmit, base44/shared/retention.ts |
| registrations | base44/functions/adminDashboard, base44/functions/announcements, base44/functions/eventsAdmin, base44/functions/eventsCancel, base44/functions/eventsPublic, base44/functions/myEvents, base44/shared/publicData.ts, base44/shared/registrations.ts |
| silence_sessions | base44/functions/adminDashboard, base44/functions/silenceAdmin, base44/functions/silenceSession |
| silence_settings | base44/functions/adminDashboard, base44/functions/silenceAdmin |
| subscribers | base44/functions/adminDashboard, base44/functions/adminNewsletter, base44/functions/adminSubscribers, base44/functions/mySettings, base44/shared/newsletter.ts, base44/shared/smtp.ts |
| waitlist | base44/functions/adminDashboard, base44/functions/adminOrders, base44/functions/adminProducts, base44/functions/cmsScheduled, base44/functions/shopWaitlist |
| webinar_1_11 | base44/functions/webinarSignup |

## Funkcje SQL (RPC)

`app_settings_get`, `bk_admin_calendar`, `bk_admin_detail`, `bk_admin_packages`, `bk_answers_retention`, `bk_book`, `bk_book_package`, `bk_cancel`, `bk_easter`, `bk_export_rows`, `bk_fill_holidays`, `bk_free_slots`, `bk_grant_package`, `bk_log_anonymize`, `bk_log_guard`, `bk_log_purge`, `bk_manage_view`, `bk_mark_status`, `bk_my_sessions`, `bk_rate_hit`, `bk_reschedule`, `bk_return_session`, `bk_rotate_ical`, `bk_token_package`, `exm_register`, `mb_admin_assign_many`, `mb_admin_assignment_bulk`, `mb_admin_assignment_preview`, `mb_admin_assignment_revoke`, `mb_admin_assignment_save`, `mb_admin_assignments_of`, `mb_admin_client_mb`, `mb_admin_clients_mb`, `mb_admin_collections`, `mb_admin_dashboard`, `mb_admin_group_detail`, `mb_admin_group_members`, `mb_admin_groups`, `mb_admin_history`, `mb_admin_material_impact`, `mb_admin_material_register`, `mb_admin_material_save`, `mb_admin_materials`, `mb_admin_message_attachments`, `mb_admin_message_cancel`, `mb_admin_message_claim`, `mb_admin_message_delete`, `mb_admin_message_edit`, `mb_admin_message_finish`, `mb_admin_message_notify`, `mb_admin_message_save`, `mb_admin_message_send_rate`, `mb_admin_message_stats`, `mb_admin_message_withdraw`, `mb_admin_messages`, `mb_admin_settings_save`, `mb_admin_space`, `mb_admin_template_delete`, `mb_admin_template_save`, `mb_admin_templates`, `mb_auto_group_emails`, `mb_client_bundle`, `mb_client_library`, `mb_client_messages`, `mb_client_open`, `mb_group_members_now`, `mb_lib_settings`, `mb_link_hit`, `mb_log_add`, `mb_log_anonymize`, `mb_log_guard`, `mb_log_purge`, `mb_material_complete`, `mb_message_flag`, `mb_move_email`, `mb_resolve_recipients`, `mb_visible_materials`
