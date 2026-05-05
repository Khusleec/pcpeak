-- QPay v2 deposit tracking (see 004_qpay_ebarimt.sql for E-barimt 3.0 column)
ALTER TABLE bookings
  ADD COLUMN payment_status VARCHAR(24) NOT NULL DEFAULT 'not_required'
    COMMENT 'not_required|unpaid|paid' AFTER status,
  ADD COLUMN qpay_invoice_id VARCHAR(64) NULL DEFAULT NULL AFTER payment_status,
  ADD COLUMN qpay_payment_id VARCHAR(64) NULL DEFAULT NULL AFTER qpay_invoice_id,
  ADD COLUMN qpay_checkout_json JSON NULL DEFAULT NULL COMMENT 'urls + qr_text from invoice create' AFTER qpay_payment_id;
