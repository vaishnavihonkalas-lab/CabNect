const bcrypt = require('bcrypt');
exports.hashPassword = password => bcrypt.hash(password, 10);
exports.comparePassword = (password, hash) => bcrypt.compare(password, hash);
