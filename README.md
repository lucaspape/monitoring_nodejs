# monitoring_nodejs

I didnt want to configure icinga2 because it looked like shit, it was faster to just create my own monitoring service.

There are hosts and commands to configure, the hosts will use the commands to check your services.

# how to install

clone this repo  

run ```ǹpm install```

# how to run

run ```npm start```  

# commands
```
{
   "name":"check_http",
   "required_vars":[
      "hostname"
   ],
   "command":"curl $hostname --fail --silent --show-error"
}
```

Every command must have a unique ```name```, a ```required_vars``` array (can be empty) and the actual ```command```.  
You can specify vars in ```required_vars``` and then use these vars in ```command``` by using a ```$```.

__By default a command is considered failed if it outputs an error into stderr.__

You can change it like this:

```
{
   "name":"check_procs",
   "required_vars":[],
   "command":"ps -e | wc -l",
   "error_on": "out_larger_than_value",
   "error_value": 500
}
```

Now the command is considered failed when the output is larger than 500.  

Available ```error_on``` methods:

```out_larger_than_value```       output is larger than value  
```out_smaller_than_value```      output is smaller than value  
```value_exact_out```             output is exactly value  
```value_not_exact_out```         output is exactly not value  

You can do the same thing with warnings:

```
{
   "name":"check_updates_yay",
   "required_vars":[],
   "command":"yay -Qu | wc -l",
   "warning_on": "out_larger_than_value",
   "warning_value": 0
}
```
  
Available ```warning_on``` methods: same as ```error_on``` methods  

# hosts

```
{
   "name":"lucaspape.de",
   "notify": [
     {
       "how": "email",
       "vars": {
         "email": "admin@lucaspape.de"
       }
     },
     {
       "how": "influx"
     }
   ],
   "check_commands":[
      {
         "command_name": "check_http",
         "unique_name": "check_http_lucaspape",
         "vars":{
            "web_url":"https://lucaspape.de"
         }
      },
      {
         "command_name":"check_alive_ip4",
         "vars":{
            "ip4":"1.1.1.1"
         }
      }
   ]
}
```

Every host must have a unique ```name```, a ```notify``` array and a ```check_commands``` array.  

The ```notify``` array contains methods on how to notify the user. Every object in the array must have a ```how``` (currently ```email``` or ```influx```) and optionally an extra ```vars``` array.  

The ```check_commands``` array contains the commands that will be run to check system health.  
Every command must have a ```command_name```, this must be the same as the command ```name``` declared in the command.  
Optionally it can have a ```vars``` object for variables.  
Optionally ```unique_name``` can be used, if missing it will be generated.

# config

```reoccurring_error_message_time```: time between two error messages (that resulted from the same command) in minutes  
```reoccurring_warning_message_time```: time between two warning messages (that resulted from the same command) in minutes  
```check_time```: time between batch of commands in seconds  
```command_timeout```: timeout of single command in seconds  
```validate_error```: retries if command returns error  
```mail``` mail configuration  
```ìnfluxdb``` influxdb configuration  

# todo
- cpu usage command
- memory usage command
