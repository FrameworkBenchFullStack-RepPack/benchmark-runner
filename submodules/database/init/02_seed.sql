INSERT INTO category (name) VALUES
    ('Rhoncus'),
    ('Metus'),
    ('Egestas'),
    ('Dapibus');

\copy person (name, age, category_id) FROM './data/Person.csv' WITH (FORMAT CSV);
