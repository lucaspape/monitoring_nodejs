const fs = require('fs');
const { exec } = require("child_process");
var nodemailer = require('nodemailer');

const command_dir = 'commands/';
const host_dir = 'hosts/';

const mail_config = JSON.parse(fs.readFileSync('mail_config.json'));

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
    }, 20000);
  })
});

function send_notification(command_result){
  if(command_result.status !== 'ok'){
    switch(command_result.command.notify){
      case 'email':
        send_email({host:command_result.host, command:command_result.command, notify_vars: command_result.command.notify_vars, status: command_result.status, error: command_result.error});
        break;
      default:
        console.log('Cant find notification type');
    }
  }
}


var transporter = nodemailer.createTransport(mail_config);

function send_email(notification){
  transporter.sendMail({
    from: 'notifcation@lucaspape.de',
    to: notification.notify_vars.email,
    subject: 'Error while checking command ' + notification.command.name,
    text: notification.command.name + ' returned ' + notification.status + ' on ' + notification.host.name + ' \n \n ' + notification.error
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
        var status = '';

        if(error){
          status = 'error';
        }else if(stderr){
          status = 'error';
        }else{
          status = 'ok';
        }

        callback({'host': host, 'command': check_command, 'status': status, 'error': error + '\n' + stderr});
      });
    }
  });
}
