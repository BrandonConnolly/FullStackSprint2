-- CREATE TABLE IF NOT EXISTS public."userdata"
-- (
--     id serial NOT NULL,
--     user_id character varying(32) COLLATE pg_catalog."default" NOT NULL,
--     keywords character varying(128) COLLATE pg_catalog."default" NOT NULL,
--     uuid uuid NOT NULL,
--     created_at timestamp DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT "userdata_pkey" PRIMARY KEY (id),
--     CONSTRAINT unique_userdata UNIQUE (userdata)
-- )

CREATE TABLE IF NOT EXISTS public."userdata"(
    id serial PRIMARY KEY,
    user_id character varying(32) NOT NULL,
    keywords character varying(128) NOT NULL,
    timestamp timestamp DEFAULT CURRENT_TIMESTAMP
);
