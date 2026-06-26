CREATE TABLE category (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE person (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    age         SMALLINT     NOT NULL,
    category_id INT          NOT NULL REFERENCES category (id)
);
