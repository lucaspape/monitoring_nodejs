const { exec } = require("child_process");

module.exports = function (host, commands, callback){
  host.check_commands.forEach(check_command => {
    if(!commands[check_command.command_name]){
      console.log('Could not find command: ' + check_command.command_name);
    }else{
      console.log('Running command: ' + check_command.command_name);

      var command = commands[check_command.command_name];

      var run_command = command.command;
      var debug_command = command.debug_command;

      var has_required_vars = true;

      command.required_vars.forEach((required_var) => {
        if(!check_command.vars[required_var]){
          has_required_vars = false;
        }else{
          run_command = run_command.replace('$' + required_var, check_command.vars[required_var]);

          if(debug_command){
            debug_command = debug_command.replace('$' + required_var, check_command.vars[required_var]);
          }
        }
      });

      if(!has_required_vars){
        callback();
      }else{
        exec_command(run_command, 3, (result) => {
          var error_or_warning = check_for_method(result.error, result.stderr, result.stdout, 'error', command.failure_on, command.failure_value);

          if(!error_or_warning){
            error_or_warning = check_for_method(result.error, result.stderr, result.stdout, 'warning', command.warning_on, command.warning_value);
          }

          if(!error_or_warning){
            if(result.error){
              error_or_warning = { state: 'error', message: result.error};
            }else if(result.stderr){
              error_or_warning = { state: 'error', message: result.stderr};
            }else{
              error_or_warning = { state: 'ok', message: result.stdout};
            }
          }

          if(debug_command){
            exec_command(debug_command, 1, (result)=>{
              callback(host, check_command, error_or_warning.state, error_or_warning.message + '\n\nDebug information:\n\n' + 'stdout:\n' +  result.stdout + 'stderr:\n' + result.stderr + '\n');
            });
          }else{
            callback(host, check_command, error_or_warning.state, error_or_warning.message);
          }
        });
      }
    }
  });
}

function exec_command(command, runs, callback){
  var i = 0;

  var lastError = '';
  var lastStderr = '';
  var lastStdout = '';

  var command_callback = function(){
    if(i < runs){
      exec('timeout 10 bash -c "' + command + '"', (error, stdout, stderr) => {
        if(error || stderr){
          i++;

          lastError = error;
          lastStderr = stderr;
          lastStdout = stdout;

          command_callback();
        }else{
          //NO MORE error
          callback({error: error, stdout:stdout, stderr:stderr});
        }
      });
    }else{
      //MULTIPLE TRIES FAILED
      callback({error: lastError, stdout:lastStderr, stderr:lastStdout});
    }
  }

  command_callback();
}

function check_for_method(error, stderr, stdout, failure_state, command_method, command_value){
  switch(command_method){
    case 'out_larger_than_value':
      if(stdout > command_value){
        return({ state: failure_state, message: stdout + ' is bigger than ' + failure_state + ' value ' + command_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'out_smaller_than_value':
      if(stdout < command_value){
        return({ state: failure_state, message: stdout + ' is smaller than ' + failure_state + ' value ' + command_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'value_exact_out':
      if(command_value == stdout){
        return({ state: failure_state, message: stdout + ' is exactly ' + failure_state + ' value ' + command_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    case 'value_not_exact_out':
      if(command_value != stdout){
        return({ state: failure_state, message: stdout + ' is not ' + failure_state + ' value ' + command_value});
      }else{
        return({ state: 'ok'});
      }

      break;
    default:
      return undefined;
  }
}
