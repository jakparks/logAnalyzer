mongoimport --db mysterydb --collection users --type json --file server/data/users.json --jsonArray
mongoimport --db mysterydb --collection themes --type json --file server/data/themes.json --jsonArray
mongoimport --db mysterydb --collection datasets --type json --file server/data/datasets.json --jsonArray --ignoreBlanks
mongoimport --db mysterydb --collection apps --type json --file server/data/appsDataset.json --jsonArray
mongoimport --db mysterydb --collection books --type json --file server/data/booksDataset.json --jsonArray
mongoimport --db mysterydb --collection movies --type json --file server/data/moviesDataset.json --jsonArray
