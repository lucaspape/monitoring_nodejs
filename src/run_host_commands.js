const { exec } = require("child_process");

module.exports = function (host, commands, callback){
  host.check_commands.forEach(check_command => {
    if(!commands[check_command.command_name]){
      console.log('Could not find command: ' + check_command.command_name);
    }else{
      console.log('Running command: ' + check_command.command_name);

      var command = commands[check_command.command_name];

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
          var error_or_warning = check_for_error(command, error, stderr, stdout);

          callback(host, check_command, error_or_warning.state, error_or_warning.message);
        });
      }
    }
  });
}

function check_for_error(command, error, stderr, stdout){
  switch(command.failure_on){
    case 'out_larger_than_value':
      if(stdout > command.failure_value){
        return({ state: 'error', message: stdout + ' is bigger than failure value ' + command.failure_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'out_smaller_than_value':
      if(stdout < command.failure_value){
        return({ state: 'error', message: stdout + ' is smaller than failure value ' + command.failure_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'value_exact_out':
      if(command.failure_value == stdout){
        return({ state: 'error', message: stdout + ' is exactly failure value ' + command.failure_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'value_not_exact_out':
      if(command.failure_value != stdout){
        return({ state: 'error', message: stdout + ' is not failure value ' + command.failure_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    default:
      return check_for_warning(command, error, stderr, stdout);
  }
}

function check_for_warning(command, error, stderr, stdout){
  switch(command.warning_on){
    case 'out_larger_than_value':
      if(stdout > command.warning_value){
        return({ state: 'warning', message: stdout + ' is bigger than warning value ' + command.warning_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'out_smaller_than_value':
      if(stdout < command.warning_value){
        return({ state: 'warning', message: stdout + ' is smaller than warning value ' + command.warning_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'value_exact_out':
      if(command.warning_value == stdout){
        return({ state: 'warning', message: stdout + ' is exactly warning value ' + command.warning_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'value_not_exact_out':
      if(command.warning_value != stdout){
        return({ state: 'warning', message: stdout + ' is not warning value ' + command.warning_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    default:
      if(error){
        return({ state: 'error', message: error});
      }else if(stderr){
        return({ state: 'error', message: stderr});
      }else{
        return({ state: 'ok', message: stdout});
      }
  }
}
