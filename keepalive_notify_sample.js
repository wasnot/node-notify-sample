//
// Sample Notify Server
// H.O., edit akihiroaida
//

var net     = require('net');
var opts    = require('opts');
var log4js  = require('log4js');
var http = require('http');
var url = require('url');

var clients = new Array();
var sockets = new Array();

//
// options
//
opts.parse([
    {
    'short':'b',
    'long':'bind',
    'description':'bind address:port',
    'value':true,
    'required':false
    },
]);

//
// default values
//
var tmp_bind  = opts.get('bind') || '127.0.0.1:443';
var bind      = tmp_bind.split(':');

//
// set to clients list
//
function setClient(socket,node){
    clients[node] = socket;
}

//
// get client uniq id
//
function getClient(node){
    // get target
    var target = clients[node];

    if( target ){
        log.debug("NotifyTo="+node+":"+target.remoteAddress);
        return target;
    }else{
        log.debug("notfound="+node);
        return undefined;
    }
}

//
// set client socket list
//
function setClientSocketNode(socket,node){
    var remoteAddr = socket.remoteAddress;
    var remotePort = socket.remotePort;
    sockets[remoteAddr+':'+remotePort] = node;
}

//
// get client node from socket
//
function getClientSocketNode(socket){
    var remoteAddr = socket.remoteAddress;
    var remotePort = socket.remotePort;
 
    var node = sockets[remoteAddr+':'+remotePort];
    return node;
}

// log settings 
log4js.configure({
    appenders: [
        {
            type: "clustered",
            appenders: [
             { type: 'console' },
             { type: 'file',
               filename: './logs/keepalive_notify.log',
               maxLogSize: 1000000,
               backups: 5 },
            ]
        }
    ]
});
var log = log4js.getLogger("master");

var server = net.createServer( function(socket) {

    socket.write("welcome to KeepAlive notify : <"+socket.remoteAddress+">\r\n");
    socket.setTimeout(4*60*1000); // timeout settings 4MIN

    socket.setNoDelay(true);
    socket.setEncoding('ascii');
    socket.setKeepAlive(true,1000 * 10);

    socket.on("data",function(data){
        var str = data;
        //log.debug("=>"+str);

        if( str.toString().indexOf("quit") == 0 ){
            socket.end();
            socket.destroy();
        }else if( str.toString().indexOf("ping") == 0 ){
            socket.write("pong\r\n");
            log.debug("client alive ");
        }else if( str.toString().indexOf("pong") == 0 ){
            log.debug("client alive ");
        }else if( str.toString().indexOf('regist') == 0 ){
            var arr = str.toString().split(" ");
            var node = arr[1].toString().replace(/\n/g,"");
            node = node.replace(/\r/g,"");

            // if old socket exists. disconnect old socket.
            var old_socket = getClient(node);
            if( old_socket ){
                old_socket.end();
                old_socket.destroy();
                log.debug("old socket closed.."+node);
            }else{
                log.debug("new socket create.."+node);
            }

            // add new socket and node
            setClient(socket, node);
            setClientSocketNode(socket, node);
            log.debug('REGIST='+node+":"+socket.remoteAddress);
        }else{
            //socket.write(data);
            var node = getClientSocketNode(socket);
            log.debug("RESPONSE="+node+":"+socket.remoteAddress+":"+data);
        }
    });

    socket.on("error",function(e){
        var close_node = getClientSocketNode(socket);
        log.debug("client error..:"+close_node);
    });

    socket.on("close",function(){
        var close_node = getClientSocketNode(socket);
        log.debug("client close..:"+close_node);
    });

    socket.on("end",function(){
        var close_node = getClientSocketNode(socket);
        log.debug("client disconnected..:"+close_node);
    });

    socket.on("timeout",function(){
        var close_node = getClientSocketNode(socket);
        log.debug("client timeout session close :"+close_node+","+socket.remoteAddress);
        socket.end();
        socket.destroy();
    });

}).listen(Number(bind[1]));

//
// event from httpGetRequest
//
var httpServer = http.createServer(function(req, res){
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;

    if(query.name){
        var result;
        try{
            var message = query.message;
            if( message ){
                var target = getClient(query.name);
                if( target ){
                    target.write(message+'\r\n');
                    result = "SUCCESS";
                }else{
                    log.debug("no client");
                    result = "NO CLIENT";
                }
            }else{
                log.debug("unknown:"+data);
                result = "NO MESSAGE";
            }
        }catch(e){
            log.error("network write error");
            result = "WRITE ERROR";
        }
        res.write(result);
        res.end();
    }else{
        res.write('NO NAME');
        res.end();
    }
}).listen(3000);


//
// catch exception
//
process.on('uncaughtException', function (err) {
    log.error('uncaughtException => ' + err);
});

log.info("Server running at "+bind[0]+" , "+bind[1]);

//
// EOF
//

