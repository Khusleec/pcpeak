-- E-barimt 3.0 payload from QPay Merchant API v2 (POST /v2/ebarimt/create)
ALTER TABLE bookings
  ADD COLUMN qpay_ebarimt_json JSON NULL DEFAULT NULL
    COMMENT 'E-barimt create response (after paid)' AFTER qpay_checkout_json;
