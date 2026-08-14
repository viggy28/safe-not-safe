export const unsafeSample = `ALTER TABLE users ADD COLUMN last_seen_at timestamptz DEFAULT now();

CREATE INDEX users_email_idx ON users (email);

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id);`;

export const safeSample = `ALTER TABLE users ADD COLUMN status text DEFAULT 'active';

CREATE INDEX CONCURRENTLY users_created_at_idx
  ON users (created_at);

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

ALTER TABLE orders VALIDATE CONSTRAINT orders_user_id_fk;`;
