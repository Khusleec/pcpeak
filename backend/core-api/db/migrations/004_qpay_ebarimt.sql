-- E-barimt 3.0 (QPay v2) — run on existing DBs if initdb already applied without this file.
ALTER TABLE bookings
  ADD COLUMN qpay_ebarimt_json JSON NULL DEFAULT NULL
    COMMENT 'E-barimt create response (after paid)' AFTER qpay_checkout_json;
