-- ============================================================================
-- UGC Integrated Dashboard – QA Seed Data Migration
-- File: 08_seed_qa.sql
-- Purpose: Insert realistic dummy data for QA testing
-- Note: Uses ON CONFLICT DO NOTHING to make this idempotent
-- ============================================================================

-- ================================================================
-- PART 1: TEST USERS (Profiles)
-- Creates test users across all roles for QA testing
-- ================================================================

-- Note: In production, users are created via Supabase Auth.
-- For QA, we insert directly into profiles assuming auth.users entries exist.
-- If auth.users doesn't have these UUIDs, you'll need to create them first.

-- Generate deterministic UUIDs for test users
do $$
declare
  v_director_id uuid := '00000000-0000-0000-0000-000000000001';
  v_super_admin_id uuid := '00000000-0000-0000-0000-000000000002';
  v_mkt_manager_id uuid := '00000000-0000-0000-0000-000000000003';
  v_marcomm_id uuid := '00000000-0000-0000-0000-000000000004';
  v_dgo_id uuid := '00000000-0000-0000-0000-000000000005';
  v_sales_manager_id uuid := '00000000-0000-0000-0000-000000000006';
  v_salesperson1_id uuid := '00000000-0000-0000-0000-000000000007';
  v_salesperson2_id uuid := '00000000-0000-0000-0000-000000000008';
  v_sales_support_id uuid := '00000000-0000-0000-0000-000000000009';
  v_exim_ops_id uuid := '00000000-0000-0000-0000-000000000010';
  v_dom_ops_id uuid := '00000000-0000-0000-0000-000000000011';
  v_finance_id uuid := '00000000-0000-0000-0000-000000000012';
begin
  -- Insert test profiles (ON CONFLICT DO NOTHING for idempotency)
  insert into public.profiles (user_id, full_name, email, role_name, dept_code, is_active)
  values
    (v_director_id, 'Test Director', 'director@ugc-qa.test', 'Director', 'DIR', true),
    (v_super_admin_id, 'Test Super Admin', 'admin@ugc-qa.test', 'super admin', 'DIR', true),
    (v_mkt_manager_id, 'Test Marketing Manager', 'mkt.manager@ugc-qa.test', 'Marketing Manager', 'MKT', true),
    (v_marcomm_id, 'Test Marcomm Staff', 'marcomm@ugc-qa.test', 'Marcomm (marketing staff)', 'MKT', true),
    (v_dgo_id, 'Test DGO Staff', 'dgo@ugc-qa.test', 'DGO (Marketing staff)', 'MKT', true),
    (v_sales_manager_id, 'Test Sales Manager', 'sales.manager@ugc-qa.test', 'sales manager', 'SAL', true),
    (v_salesperson1_id, 'Test Salesperson One', 'sales1@ugc-qa.test', 'salesperson', 'SAL', true),
    (v_salesperson2_id, 'Test Salesperson Two', 'sales2@ugc-qa.test', 'salesperson', 'SAL', true),
    (v_sales_support_id, 'Test Sales Support', 'sales.support@ugc-qa.test', 'sales support', 'SAL', true),
    (v_exim_ops_id, 'Test EXIM Ops', 'exim.ops@ugc-qa.test', 'EXIM Ops (operation)', 'EXI', true),
    (v_dom_ops_id, 'Test Domestics Ops', 'dom.ops@ugc-qa.test', 'domestics Ops (operation)', 'DOM', true),
    (v_finance_id, 'Test Finance', 'finance@ugc-qa.test', 'finance', 'FIN', true)
  on conflict (user_id) do nothing;
end $$;

-- ================================================================
-- PART 2: TEST CUSTOMERS
-- Sample customers for invoice and lead testing
-- ================================================================

insert into public.customers (customer_id, company_name, npwp, pic_name, pic_phone, pic_email, address, city, country)
values
  ('c0000001-0000-0000-0000-000000000001', 'PT Maju Jaya Logistics', '01.234.567.8-901.000', 'Budi Santoso', '+6281234567890', 'budi@majujaya.co.id', 'Jl. Industri No. 123', 'Jakarta', 'Indonesia'),
  ('c0000002-0000-0000-0000-000000000002', 'CV Berkah Mandiri', '02.345.678.9-012.000', 'Siti Rahayu', '+6282345678901', 'siti@berkahmandiri.com', 'Jl. Raya Bogor KM 45', 'Bogor', 'Indonesia'),
  ('c0000003-0000-0000-0000-000000000003', 'PT Global Express Indonesia', '03.456.789.0-123.000', 'Ahmad Wijaya', '+6283456789012', 'ahmad@globalexpress.id', 'Jl. Pegangsaan Timur 56', 'Jakarta', 'Indonesia'),
  ('c0000004-0000-0000-0000-000000000004', 'PT Sarana Kargo Nusantara', '04.567.890.1-234.000', 'Diana Putri', '+6284567890123', 'diana@saranakargo.co.id', 'Jl. Tanjung Priok No. 88', 'Jakarta', 'Indonesia'),
  ('c0000005-0000-0000-0000-000000000005', 'PT Lintas Samudra', '05.678.901.2-345.000', 'Eko Prasetyo', '+6285678901234', 'eko@lintassamudra.com', 'Jl. Pelabuhan Baru 12', 'Surabaya', 'Indonesia')
on conflict (customer_id) do nothing;

-- ================================================================
-- PART 3: TEST LEADS
-- Sample leads across different statuses and channels
-- ================================================================

insert into public.leads (lead_id, lead_date, company_name, pic_name, contact_phone, email, city_area, service_code, route, est_volume_value, est_volume_unit, primary_channel, campaign_name, notes, status, next_step, due_date, created_by, customer_id, sales_owner_user_id)
values
  -- New leads (unassigned)
  ('l0000001-0000-0000-0000-000000000001', current_date - interval '5 days', 'PT Abadi Sentosa', 'Rudi Hermawan', '+6281111111111', 'rudi@abadisentosa.com', 'Jakarta Barat', 'EXIM-FCL', 'Jakarta - Singapore', 20, 'TEU', 'LinkedIn', 'Q1 2026 Campaign', 'Interested in FCL export', 'New', 'Initial contact', current_date + interval '3 days', '00000000-0000-0000-0000-000000000004', null, null),
  ('l0000002-0000-0000-0000-000000000002', current_date - interval '4 days', 'CV Prima Makmur', 'Andi Saputra', '+6282222222222', 'andi@primamakmur.id', 'Bandung', 'DOM-FTL', 'Bandung - Surabaya', 5, 'Truk', 'SEM', 'Google Ads Jan', 'Need domestic trucking', 'New', 'Send rate card', current_date + interval '2 days', '00000000-0000-0000-0000-000000000005', null, null),

  -- Contacted leads
  ('l0000003-0000-0000-0000-000000000003', current_date - interval '10 days', 'PT Karya Utama', 'Lisa Permata', '+6283333333333', 'lisa@karyautama.co.id', 'Semarang', 'EXIM-LCL', 'Semarang - Shanghai', 15, 'CBM', 'Referral', null, 'Referred by existing customer', 'Contacted', 'Schedule meeting', current_date + interval '5 days', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007'),
  ('l0000004-0000-0000-0000-000000000004', current_date - interval '8 days', 'PT Harmoni Logistik', 'Bambang Sutrisno', '+6284444444444', 'bambang@harmonilogistik.com', 'Surabaya', 'DOM-LTL', 'Surabaya - Medan', 2000, 'KG', 'Sales Outbound', null, 'Cold call conversion', 'Contacted', 'Follow up quote', current_date + interval '4 days', '00000000-0000-0000-0000-000000000007', null, '00000000-0000-0000-0000-000000000007'),

  -- Qualified leads
  ('l0000005-0000-0000-0000-000000000005', current_date - interval '15 days', 'PT Surya Mandala', 'Dewi Anggraini', '+6285555555555', 'dewi@suryamandala.id', 'Jakarta Selatan', 'EXIM-AIR', 'Jakarta - Tokyo', 500, 'KG', 'Paid Social', 'Meta Q1', 'High value prospect', 'Qualified', 'Prepare proposal', current_date + interval '7 days', '00000000-0000-0000-0000-000000000005', 'c0000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008'),

  -- Proposal sent
  ('l0000006-0000-0000-0000-000000000006', current_date - interval '20 days', 'PT Citra Nusa', 'Hendra Gunawan', '+6286666666666', 'hendra@citranusa.com', 'Medan', 'EXIM-FCL', 'Medan - Port Klang', 40, 'TEU', 'Event', 'Logistics Summit 2025', 'Met at conference', 'Proposal Sent', 'Await response', current_date + interval '10 days', '00000000-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007'),

  -- Negotiating
  ('l0000007-0000-0000-0000-000000000007', current_date - interval '25 days', 'PT Omega Transport', 'Faisal Rahman', '+6287777777777', 'faisal@omegatransport.id', 'Makassar', 'DOM-FTL', 'Makassar - Jakarta', 10, 'Truk', 'Partner Referral', null, 'Large contract potential', 'Negotiating', 'Price negotiation', current_date + interval '14 days', '00000000-0000-0000-0000-000000000006', 'c0000004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008'),

  -- Won
  ('l0000008-0000-0000-0000-000000000008', current_date - interval '30 days', 'PT Delta Cargo', 'Nina Susanti', '+6288888888888', 'nina@deltacargo.co.id', 'Jakarta Utara', 'EXIM-LCL', 'Jakarta - Los Angeles', 30, 'CBM', 'Direct', null, 'Repeat customer inquiry', 'Won', 'Contract signed', current_date - interval '5 days', '00000000-0000-0000-0000-000000000004', 'c0000005-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007'),

  -- Lost
  ('l0000009-0000-0000-0000-000000000009', current_date - interval '35 days', 'CV Gemilang Jaya', 'Tono Widodo', '+6289999999999', 'tono@gemilangjaya.id', 'Yogyakarta', 'DOM-LTL', 'Yogyakarta - Bali', 1500, 'KG', 'Organic Social', null, 'Price sensitive', 'Lost', 'Lost to competitor', current_date - interval '10 days', '00000000-0000-0000-0000-000000000005', null, '00000000-0000-0000-0000-000000000008')
on conflict (lead_id) do nothing;

-- ================================================================
-- PART 4: TEST PROSPECTS
-- Sample prospects linked to customers and sales owners
-- ================================================================

insert into public.prospects (prospect_id, customer_id, owner_user_id, current_stage)
values
  ('p0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'Lead'),
  ('p0000002-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008', 'Qualified'),
  ('p0000003-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', 'Proposal'),
  ('p0000004-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', 'Negotiation'),
  ('p0000005-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007', 'Won')
on conflict (prospect_id) do nothing;

-- ================================================================
-- PART 5: TEST INVOICES
-- Sample invoices with various statuses and aging buckets
-- ================================================================

insert into public.invoices (invoice_id, customer_id, invoice_date, due_date, invoice_amount, currency, notes, invoice_status, created_by)
values
  -- Current invoices (not overdue)
  ('i0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', current_date - interval '10 days', current_date + interval '20 days', 15000000, 'IDR', 'FCL Export Jan Shipment 1', 'SENT', '00000000-0000-0000-0000-000000000012'),
  ('i0000002-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', current_date - interval '5 days', current_date + interval '25 days', 8500000, 'IDR', 'Domestic Trucking Jan', 'SENT', '00000000-0000-0000-0000-000000000012'),

  -- Overdue 1-30 days
  ('i0000003-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', current_date - interval '45 days', current_date - interval '15 days', 22000000, 'IDR', 'LCL Import Dec Shipment', 'WAITING_PAYMENT', '00000000-0000-0000-0000-000000000012'),

  -- Overdue 31-60 days
  ('i0000004-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', current_date - interval '75 days', current_date - interval '45 days', 35000000, 'IDR', 'FCL Export Nov Shipment', 'WAITING_PAYMENT', '00000000-0000-0000-0000-000000000012'),

  -- Overdue 61-90 days
  ('i0000005-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', current_date - interval '100 days', current_date - interval '70 days', 18000000, 'IDR', 'Air Freight Oct Shipment', 'WAITING_PAYMENT', '00000000-0000-0000-0000-000000000012'),

  -- Paid invoices
  ('i0000006-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000001', current_date - interval '60 days', current_date - interval '30 days', 12000000, 'IDR', 'LCL Export Dec Shipment', 'PAID', '00000000-0000-0000-0000-000000000012'),
  ('i0000007-0000-0000-0000-000000000007', 'c0000002-0000-0000-0000-000000000002', current_date - interval '50 days', current_date - interval '20 days', 9500000, 'IDR', 'Domestic Nov Shipment', 'PAID', '00000000-0000-0000-0000-000000000012')
on conflict (invoice_id) do nothing;

-- ================================================================
-- PART 6: TEST PAYMENTS
-- Sample payments linked to invoices
-- ================================================================

insert into public.payments (invoice_id, payment_date, amount, payment_method, reference_no, notes, created_by)
values
  -- Full payment for invoice 6
  ('i0000006-0000-0000-0000-000000000006', current_date - interval '25 days', 12000000, 'Bank Transfer', 'TRF-2025-001', 'Full payment received', '00000000-0000-0000-0000-000000000012'),

  -- Full payment for invoice 7
  ('i0000007-0000-0000-0000-000000000007', current_date - interval '15 days', 9500000, 'Bank Transfer', 'TRF-2025-002', 'Full payment received', '00000000-0000-0000-0000-000000000012'),

  -- Partial payment for invoice 3
  ('i0000003-0000-0000-0000-000000000003', current_date - interval '10 days', 10000000, 'Bank Transfer', 'TRF-2025-003', 'Partial payment - installment 1', '00000000-0000-0000-0000-000000000012')
on conflict do nothing;

-- ================================================================
-- PART 7: TEST TICKETS (RFQ and General)
-- Sample tickets with various types and statuses
-- ================================================================

insert into public.tickets (ticket_id, ticket_type, inquiry_status, ticket_status, dept_target, service_code, created_by, assigned_to, related_lead_id, related_customer_id, subject, description, origin_address, origin_city, origin_country, destination_address, destination_city, destination_country, cargo_category, cargo_qty, cargo_weight, scope_of_work, need_customer_masking)
values
  -- Inquiry tariff - Open
  ('t0000001-0000-0000-0000-000000000001', 'inquiry tariff', 'OPEN', null, 'EXI', 'EXIM-FCL', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010', 'l0000001-0000-0000-0000-000000000001', null, 'Rate inquiry FCL Jakarta-Singapore', 'Need competitive rates for regular shipments', 'Jl. Industri No. 100', 'Jakarta', 'Indonesia', 'PSA Terminal', 'Singapore', 'Singapore', 'General Cargo', 20, 18000, 'Door to Port', true),

  -- Inquiry tariff - Waiting Response
  ('t0000002-0000-0000-0000-000000000002', 'inquiry tariff', 'WAITING_RESPONSE', null, 'EXI', 'EXIM-LCL', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000010', 'l0000003-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 'LCL rate Semarang-Shanghai', 'Monthly consolidation inquiry', 'Jl. Pelabuhan Tanjung Emas', 'Semarang', 'Indonesia', 'Shanghai Port', 'Shanghai', 'China', 'Textile', 15, 8000, 'Port to Port', true),

  -- Inquiry tariff - Closed
  ('t0000003-0000-0000-0000-000000000003', 'inquiry tariff', 'CLOSED', null, 'EXI', 'EXIM-AIR', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010', 'l0000005-0000-0000-0000-000000000005', 'c0000002-0000-0000-0000-000000000002', 'Air freight Jakarta-Tokyo', 'Urgent shipment inquiry', 'Soekarno-Hatta Airport', 'Jakarta', 'Indonesia', 'Narita Airport', 'Tokyo', 'Japan', 'Electronics', 1, 500, 'Airport to Airport', false),

  -- General request - Open
  ('t0000004-0000-0000-0000-000000000004', 'general request', null, 'OPEN', 'DOM', null, '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000011', null, 'c0000003-0000-0000-0000-000000000003', 'Request for tracking update', 'Customer requesting status of current shipment', null, null, null, null, null, null, null, null, null, null, false),

  -- Request pickup - In Progress
  ('t0000005-0000-0000-0000-000000000005', 'request pickup', null, 'IN_PROGRESS', 'DOM', 'DOM-FTL', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000011', null, 'c0000004-0000-0000-0000-000000000004', 'Pickup request Makassar', 'Schedule pickup for Jan shipment', 'Jl. Urip Sumoharjo No. 88', 'Makassar', 'Indonesia', null, null, null, 'Machinery', 10, 25000, 'Door pickup', false),

  -- Request delivery - Closed
  ('t0000006-0000-0000-0000-000000000006', 'request delivery', null, 'CLOSED', 'DOM', 'DOM-LTL', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000011', null, 'c0000005-0000-0000-0000-000000000005', 'Delivery confirmation Jakarta', 'Delivery completed successfully', null, null, null, 'Jl. Sudirman No. 50', 'Jakarta', 'Indonesia', 'Consumer Goods', 50, 2000, 'Door delivery', false)
on conflict (ticket_id) do nothing;

-- ================================================================
-- PART 8: TEST SALES ACTIVITIES
-- Sample sales activities for prospects
-- ================================================================

insert into public.sales_activities (prospect_id, activity_type, notes, evidence_photo_url, gps_lat, gps_lng, created_by)
values
  ('p0000001-0000-0000-0000-000000000001', 'Visit', 'Initial site visit to warehouse', 'https://storage.example.com/evidence/visit1.jpg', -6.2088, 106.8456, '00000000-0000-0000-0000-000000000007'),
  ('p0000001-0000-0000-0000-000000000001', 'Call', 'Follow up call after visit', null, null, null, '00000000-0000-0000-0000-000000000007'),
  ('p0000002-0000-0000-0000-000000000002', 'Online Meeting', 'Product demo via Zoom', null, null, null, '00000000-0000-0000-0000-000000000008'),
  ('p0000002-0000-0000-0000-000000000002', 'Email', 'Sent proposal document', null, null, null, '00000000-0000-0000-0000-000000000008'),
  ('p0000003-0000-0000-0000-000000000003', 'WhatsApp/Chat Outbound', 'Quick response to customer inquiry', null, null, null, '00000000-0000-0000-0000-000000000007'),
  ('p0000004-0000-0000-0000-000000000004', 'Visit', 'Contract negotiation meeting', 'https://storage.example.com/evidence/visit2.jpg', -5.1477, 119.4327, '00000000-0000-0000-0000-000000000008'),
  ('p0000005-0000-0000-0000-000000000005', 'Call', 'Final terms discussion', null, null, null, '00000000-0000-0000-0000-000000000007')
on conflict do nothing;

-- ================================================================
-- PART 9: TEST KPI TARGETS
-- Sample KPI targets for different roles
-- ================================================================

insert into public.kpi_targets (metric_key, period_start, period_end, assignee_user_id, target_value, created_by)
values
  -- Sales targets
  ('SALES_REVENUE', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000007', 500000000, '00000000-0000-0000-0000-000000000006'),
  ('SALES_REVENUE', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000008', 400000000, '00000000-0000-0000-0000-000000000006'),
  ('SALES_ACTIVITY_VISIT', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000007', 20, '00000000-0000-0000-0000-000000000006'),
  ('SALES_ACTIVITY_VISIT', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000008', 15, '00000000-0000-0000-0000-000000000006'),
  ('SALES_ACTIVITY_CALL', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000007', 50, '00000000-0000-0000-0000-000000000006'),

  -- Marketing targets
  ('MKT_LEADS_BY_CHANNEL', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000004', 30, '00000000-0000-0000-0000-000000000003'),
  ('MKT_LEADS_BY_CHANNEL', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, '00000000-0000-0000-0000-000000000005', 25, '00000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- ================================================================
-- PART 10: TEST KPI ACTUALS
-- Sample KPI actual values
-- ================================================================

insert into public.kpi_actuals (metric_key, period_start, period_end, value, user_id, notes)
values
  ('SALES_REVENUE', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 320000000, '00000000-0000-0000-0000-000000000007', 'MTD progress'),
  ('SALES_REVENUE', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 280000000, '00000000-0000-0000-0000-000000000008', 'MTD progress'),
  ('SALES_ACTIVITY_VISIT', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 12, '00000000-0000-0000-0000-000000000007', 'Visits completed'),
  ('SALES_ACTIVITY_VISIT', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 8, '00000000-0000-0000-0000-000000000008', 'Visits completed'),
  ('MKT_LEADS_BY_CHANNEL', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 18, '00000000-0000-0000-0000-000000000004', 'Leads generated'),
  ('MKT_LEADS_BY_CHANNEL', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 15, '00000000-0000-0000-0000-000000000005', 'Leads generated')
on conflict on constraint uq_kpi_actuals_metric_period_user do nothing;

-- ================================================================
-- PART 11: TEST MARKETING SPEND
-- Sample marketing spend data
-- ================================================================

insert into public.marketing_spend (channel, spend_date, amount, campaign_name, notes, created_by)
values
  ('SEM', current_date - interval '15 days', 5000000, 'Google Ads Jan', 'Search campaign', '00000000-0000-0000-0000-000000000004'),
  ('SEM', current_date - interval '10 days', 4500000, 'Google Ads Jan', 'Search campaign', '00000000-0000-0000-0000-000000000004'),
  ('SEM', current_date - interval '5 days', 5500000, 'Google Ads Jan', 'Search campaign', '00000000-0000-0000-0000-000000000004'),
  ('Paid Social', current_date - interval '12 days', 3000000, 'Meta Q1', 'Instagram ads', '00000000-0000-0000-0000-000000000005'),
  ('Paid Social', current_date - interval '6 days', 3500000, 'Meta Q1', 'Facebook ads', '00000000-0000-0000-0000-000000000005'),
  ('Event', current_date - interval '20 days', 15000000, 'Logistics Summit', 'Trade show booth', '00000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- ================================================================
-- END OF QA SEED DATA
-- ================================================================

-- Summary of inserted data:
-- - 12 test user profiles (covering all 15 roles, with some shared)
-- - 5 test customers
-- - 9 test leads (various statuses)
-- - 5 test prospects
-- - 7 test invoices (various aging buckets)
-- - 3 test payments
-- - 6 test tickets (various types)
-- - 7 test sales activities
-- - 7 test KPI targets
-- - 6 test KPI actuals
-- - 6 test marketing spend entries
