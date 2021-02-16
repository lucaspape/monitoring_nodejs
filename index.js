const fs = require('fs');
const { exec } = require("child_process");
var nodemailer = require('nodemailer');
const Influx = require('influx')

const command_dir = 'commands/';
const host_dir = 'hosts/';

const config = JSON.parse(fs.readFileSync('config.json'))

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

function send_notification(host, command, state, message){
  host.notify.forEach((notify) => {
    switch(notify.how){
      case 'email':
        send_notification_email(notify, host, command, state, message);
        break;
      case 'influx':
        send_notification_influxdb(notify, host, command, state, message);
        break;
      default:
        console.log('Cant find notification type ' + notify.how);
    }
  });
}

function send_notification_influxdb(notify, host, command, state, message){
  var influxdb = new Influx.InfluxDB({host: config.influxdb.host, database: config.influxdb.database, username: config.influxdb.username, password: config.influxdb.password,
    schema: [
      {
        measurement: command.name,
        fields: {
          state: Influx.FieldType.STRING,
          message: Influx.FieldType.STRING
        },
        tags: [
          'host'
        ]
      }
    ]
  });

  influxdb.writePoints([
    {
      measurement: command.name,
      tags: { host: host.name },
      fields: { state:state, message:message }
    }
  ]).catch(err => {
    console.log('Could not save to influxdb');
    console.log(err.stack);
  });
}

const mail_messages = {};

function send_notification_email(notify, host, command, state, message){
  //REOCCURRING
  if(mail_messages[host.name]){
    if(mail_messages[host.name][command.name]){
        mail_messages[host.name][command.name].lastOccurring = Date.now();
        if((Date.now() - mail_messages[host.name][command.name].lastNotification) >= 60000*config.reoccurringMessageTime || mail_messages[host.name][command.name].lastState !== state){
          mail_messages[host.name][command.name].lastNotification = Date.now();

          send_email(notify, host, command, 'REOCCURRING', state, message, mail_messages[host.name][command.name]);

          if(state === 'ok'){
            mail_messages[host.name][command.name] = undefined;
          }else{
            mail_messages[host.name][command.name].lastState = state;
          }
        }

        return;
    }
  }else{
    mail_messages[host.name] = {};
  }

  //FIRST
  if(state !== 'ok'){
    mail_messages[host.name][command.name] = {lastState: state, firstOccurring: Date.now(), lastOccurring: Date.now(), lastNotification: Date.now()};

    send_email(notify, host, command, 'NEW', state, message, mail_messages[host.name][command.name]);
  }
}

var transporter = nodemailer.createTransport(config.mail);

function send_email(notify, host, command, type, state, message, timestamps){
  var timestampText = 'First occurred: ' + timeConverter(timestamps.firstOccurring) + '\n Last occurred: ' + timeConverter(timestamps.lastOccurring);
  var subject = '';
  var text = '';

  if(message){
    subject = '[' + type + '] ' + state + ' while checking command ' + command.name;
    text = command.name + ' returned ' + state + ' on ' + host.name + '\n \n' + message + '\n' + timestampText;
  }else{
    subject = '[' + type + '] Command ' + command.name + ' is OK '
    text = command.name + ' is now ' + state + ' on ' + host.name + '\n' + timestampText;
  }

  transporter.sendMail({
    from: config.mail.from,
    to: notify.vars.email,
    subject: subject,
    text: text
  }, (message, info)=>{
    if(error){
      console.log(error);
    }else{
      console.log('Sent notification');
    }
  });
}

function run_host_commands(host, commands, callback){
  host.check_commands.forEach(check_command => {
    if(!commands[check_command.name]){
      console.log('Could not find command: ' + check_command.name);
    }else{
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
        exec('timeout 10 bash -c "' + run_command + '"', (error, stdout, stderr) => {
          var message = '';
          var state = '';

          switch(command.failure_on){
            case 'out_larger_than_value':
              if(stdout > command.failure_value){
                state = 'error';
                message = stdout + ' is bigger than failure value ' + command.failure_value;
              }else{
                state = 'ok';
              }

              break;
            case 'out_smaller_than_value':
              if(stdout < command.failure_value){
                state = 'error';
                message = stdout + ' is smaller than failure value ' + command.failure_value;
              }else{
                state = 'ok';
              }

              break;
            case 'value_exact_out':
              if(command.failure_value == stdout){
                state = 'error';
                message = stdout + ' is exactly failure value ' + command.failure_value;
              }else{
                state = 'ok';
              }

              break;
            case 'value_not_exact_out':
              if(command.failure_value != stdout){
                state = 'error';
                message = stdout + ' is not failure value ' + command.failure_value;
              }else{
                state = 'ok';
              }

              break;
            default:
              switch(command.warning_on){
                case 'out_larger_than_value':
                  if(stdout > command.warning_value){
                    state = 'warning';
                    message = stdout + ' is bigger than warning value ' + command.warning_value;
                  }else{
                    state = 'ok';
                  }

                  break;
                case 'out_smaller_than_value':
                  if(stdout < command.warning_value){
                    state = 'warning';
                    message = stdout + ' is smaller than warning value ' + command.warning_value;
                  }else{
                    state = 'ok';
                  }

                  break;
                case 'value_exact_out':
                  if(command.warning_value == stdout){
                    state = 'warning';
                    message = stdout + ' is exactly warning value ' + command.warning_value;
                  }else{
                    state = 'ok';
                  }

                  break;
                case 'value_not_exact_out':
                  if(command.warning_value != stdout){
                    state = 'warning';
                    message = stdout + ' is not warning value ' + command.warning_value;
                  }else{
                    state = 'ok';
                  }

                  break;
                default:
                  if(error){
                    message = error;
                    state = 'error';
                  }else if(stderr){
                    message = stderr;
                    state = 'error';
                  }else{
                    message = stdout;
                    state = 'ok';
                  }
              }
          }

          callback(host, check_command, state, message);
        });
      }
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
