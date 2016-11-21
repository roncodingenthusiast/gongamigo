var mysql = require('mysql');
var conn;

function handleConnect(){
	conn = mysql.createPool({
		host     : 'us-cdbr-iron-east-04.cleardb.net',
		user     : process.env.db_username,
		password : process.env.db_pwd,
		database : 'heroku_49f6c5ea0a93650'
	});
}
handleConnect();
module.exports = {
	conn: conn
}