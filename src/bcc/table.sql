BEGIN;

CREATE TABLE bcc (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    chat_id BIGINT NOT NULL UNIQUE,
    tags TEXT[] COLLATE "C" NOT NULL
);

COMMIT;

-- query tags (chat_id)
--  SELECT to_jsonb(tags) FROM bcc WHERE chat_id=$1;

-- add tags (chat_id, tags)
--  WITH t(tags) AS (
--      SELECT ARRAY(
--          SELECT UNNEST($2::TEXT[])
--          UNION
--          SELECT UNNEST(tags) FROM bcc WHERE chat_id=$1
--      )
--  )
--  INSERT INTO bcc(chat_id, tags) SELECT $1, tags FROM t
--  ON CONFLICT(chat_id)
--  DO UPDATE SET tags = EXCLUDED.tags

-- remove tag (chat_id, tag)
--  WITH t(tags) AS (
--      SELECT ARRAY(
--          SELECT UNNEST(tags) FROM bcc WHERE chat_id=$1
--          EXCEPT
--          SELECT UNNEST($2::TEXT[])
--      )
--  )
--  update bcc set tags = t.tags from t where bcc.chat_id=$1
