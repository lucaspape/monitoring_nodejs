const fs = require('fs');
const { exec } = require("child_process");
var nodemailer = require('nodemailer');

const command_dir = 'commands/';
const host_dir = 'hosts/';

const config = JSON.parse(fs.readFileSync('config.json'))

const errors = {};

fs.readdir(command_dir, (err, files) => {
  var commands = {};

  files.forEach(file => {
    var command = JSON.parse(fs.readFileSync(command_dir + '/' + file));

    commands[command.name] = command;
  });

  console.log('Loaded commands');

  var hosts = [];

  fs.readdir(host_dir, (err, files) => {
    files.forEach(file => {
      var host = JSON.parse(fs.readFileSync(host_dir + '/' + file));

      hosts.push(host)
    });

    console.log('Loaded hosts');

    setInterval(()=>{
      hosts.forEach(host => {
        console.log('Checking: ' + host.name);

        run_host_commands(host, commands, send_notification);
      });
    }, 1000*config.checkTime);
  })
});

function send_notification(host, command, state, error){
  //REOCCURRING
  if(errors[host.name]){
    if(errors[host.name][command.name]){
        errors[host.name][command.name].lastOccurring = Date.now();
        if((Date.now() - errors[host.name][command.name].lastNotification) >= 60000*config.reoccurringMessageTime || errors[host.name][command.name].lastState !== state){
          errors[host.name][command.name].lastNotification = Date.now();

          send_email(host, command, 'REOCCURRING', state, error, errors[host.name][command.name]);

          if(state === 'ok'){
            errors[host.name][command.name] = undefined;
          }else{
            errors[host.name][command.name].lastState = state;
          }
        }

        return;
    }
  }else{
    errors[host.name] = {};
  }

  //FIRST
  if(state !== 'ok'){
    errors[host.name][command.name] = {lastState: state, firstOccurring: Date.now(), lastOccurring: Date.now(), lastNotification: Date.now()};

    switch(command.notify){
      case 'email':
        send_email(host, command, 'NEW', state, error, errors[host.name][command.name]);
        break;
      default:
        console.log('Cant find notification type');
    }
  }
}


var transporter = nodemailer.createTransport(config.mail);

function send_email(host, command, type, state, error, timestamps){
  var timestampText = 'First occurred: ' + timeConverter(timestamps.firstOccurring) + '\n Last occurred: ' + timeConverter(timestamps.lastOccurring);
  var subject = '';
  var text = '';

  if(error){
    subject = '[' + type + '] Error while checking command ' + command.name;
    text = command.name + ' returned ' + state + ' on ' + host.name + ' \n \n ' + error + ' \n ' + timestampText;
  }else{
    subject = '[' + type + '] Command ' + command.name + ' is OK '
    text = command.name + ' is now ' + state + ' on ' + host.name + ' \n ' + timestampText;
  }

  transporter.sendMail({
    from: config.mail.from,
    to: command.notify_vars.email,
    subject: subject,
    text: text
  }, (error, info)=>{
    if(error){
      console.log(error);
    }else{
      console.log('Sent notification');
    }
  });
}

function run_host_commands(host, commands, callback){
  host.check_commands.forEach(check_command => {
    console.log('Running command: ' + check_command.name);

    var command = commands[check_command.name];

    var run_command = command.command;
    var has_required_vars = true;

    command.required_vars.forEach((required_var) => {
      if(!check_command.vars[required_var]){
        has_required_vars = false;
      }else{
        run_command = run_command.replace('$' + required_var, check_command.vars[required_var]);
      }
    });

    if(!has_required_vars){
      callback();
    }else{
      exec('bash -c "' + run_command + '"', (error, stdout, stderr) => {
        var state = '';

        if(error){
          state = 'error';
        }else if(stderr){
          state = 'error';
        }else{
          state = 'ok';
        }

        callback(host, check_command, state, error);
      });
    }
  });
}

function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}
