const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const run_host_commands = require('./run_host_commands.js');
const send_notification = require('./notification/send_notification.js');

const notification_thread = require('./notification/notification_thread.js');
notification_thread.init_vars();

const command_dir = 'commands/';
const host_dir = 'hosts/';

const config = JSON.parse(fs.readFileSync('config.json'));

if(validate_config()){
  console.log('Config validated!');

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

        host.check_commands.forEach((command, i) => {
          if(!command.unique_name){
            host.check_commands[i].unique_name = generate_unique_name(command);
          }
        });

        hosts.push(host)
      });

      console.log('Loaded hosts');

      var loop = function(){
        //SEND OUT NOTIFICATIONS
        notification_thread.thread();
        console.log('Sent notifications!');

        setTimeout(()=>{
          hosts.forEach(host => {
            console.log('Checking: ' + host.name);

            run_host_commands(config, host, commands, (host, check_command, state, message, stdout)=>{
              send_notification(notification_thread, config, host, check_command, state, message, stdout);
            }, ()=>{
              loop();
            });
          });
        },1000*config.check_time);
      }

      loop();
    })
  });
}else{
  console.log('Config validation failed!');
}

function generate_unique_name(command){
  var unique_name = command.command_name;

  if(command.vars && Object.keys(command.vars).length > 0){
    Object.keys(command.vars).forEach((key) => {
      unique_name += '-' + command.vars[key];
    });
  }else{
    unique_name += '-' + uuidv4();
  }

  return unique_name;
}

function validate_config(){
  if(config){
    if(!config.reoccurring_error_message_time){
      console.log('reoccurring_error_message_time missing in config');
      return false;
    }

    if(!config.reoccurring_warning_message_time){
      console.log('reoccurring_warning_message_time missing in config');
      return false;
    }

    if(!config.check_time){
      console.log('check_time missing in config');
      return false;
    }

    if(!config.command_timeout){
      console.log('command_timeout missing in config');
      return false;
    }

    if(!config.validate_error){
      console.log('validate_error missing in config');
      return false;
    }

    return true;
  }else{
    console.log('config.json not found!');
    return false;
  }
}
