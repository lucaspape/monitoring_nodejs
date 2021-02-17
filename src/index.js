const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const run_host_commands = require('./run_host_commands.js');
const send_notification = require('./notification/send_notification.js');

const command_dir = 'commands/';
const host_dir = 'hosts/';

const config = JSON.parse(fs.readFileSync('config.json'));



fs.readdir(command_dir, (err, files) => {
  var commands = {};

  files.forEach(file => {
    var command = JSON.parse(fs.readFileSync(command_dir + '/' + file));

    commands[command.name] = command;
  });

  console.log('Loaded commands');

  var hosts = [];

  var number_of_commands = 0;

  fs.readdir(host_dir, (err, files) => {
    files.forEach(file => {
      var host = JSON.parse(fs.readFileSync(host_dir + '/' + file));

      host.check_commands.forEach((command, i) => {
        if(!command.unique_name){
          host.check_commands[i].unique_name = command.command_name + '-' + uuidv4();
        }

        number_of_commands++;
      });

      hosts.push(host)
    });

    console.log('Loaded hosts');

    if(validate_config(number_of_commands)){
      console.log('Config validated!');

      setInterval(()=>{
        hosts.forEach(host => {
          console.log('Checking: ' + host.name);

          run_host_commands(config, host, commands, (host, check_command, state, message, stdout)=>{
            send_notification(config, host, check_command, state, message, stdout);
          });
        });
      }, 1000*config.check_time);
    }else{
      console.log('Config validation failed!');
    }
  })
});

function validate_config(number_of_commands){
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

    if((((config.command_timeout + config.command_delay) * config.validate_error))*number_of_commands > config.check_time){
      console.log('((command_timeout + command_dalay)*validate_error)*number_of_commands cannot be bigger than check_time!');
      console.log((((config.command_timeout + config.command_delay) * config.validate_error))*number_of_commands + '>' + config.check_time);
      return false;
    }

    return true;
  }else{
    console.log('config.json not found!');
    return false;
  }
}
