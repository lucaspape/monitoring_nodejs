const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const run_host_commands = require('./run_host_commands.js');
const send_notification = require('./notification/send_notification.js');

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

      host.check_commands.forEach((command,i) => {
        if(!command.unique_name){
          host.check_commands[i].unique_name = command.command_name + '-' + uuidv4();
        }
      });


      hosts.push(host)
    });

    console.log('Loaded hosts');

    setInterval(()=>{
      hosts.forEach(host => {
        console.log('Checking: ' + host.name);

        run_host_commands(host, commands, (host, check_command, state, message)=>{
          send_notification(config, host, check_command, state, message);
        });
      });
    }, 1000*config.checkTime);
  })
});
