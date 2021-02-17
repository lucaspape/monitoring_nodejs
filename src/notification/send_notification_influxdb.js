const Influx = require('influx');

module.exports = function(config, notify, host, check_command, state, message, stdout){
  var influxdb = new Influx.InfluxDB({host: config.influxdb.host, database: config.influxdb.database, username: config.influxdb.username, password: config.influxdb.password,
    schema: [
      {
        measurement: check_command.command_name,
        fields: {
          state: Influx.FieldType.STRING,
          message: Influx.FieldType.STRING,
          out_float: Influx.FieldType.FLOAT,
          stdout: Influx.FieldType.STRING
        },
        tags: [
          'host'
        ]
      }
    ]
  });

  var out_float = 0.0;

  if(!isNaN(stdout)){
    out_float = stdout.match(/\d/g);

    if(out_float){
      out_float = out_float.join("");
    }else{
      out_float = 0.0;
    }
  }

  influxdb.writePoints([
    {
      measurement: check_command.command_name,
      tags: { host: host.name },
      fields: { state:state, message:message, out_float:out_float, stdout:stdout }
    }
  ]).catch(err => {
    console.log('Could not save to influxdb');
    console.log(err.stack);
  });
}
