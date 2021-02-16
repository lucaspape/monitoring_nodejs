const Influx = require('influx');

module.exports = function(config, notify, host, check_command, state, message){
  var influxdb = new Influx.InfluxDB({host: config.influxdb.host, database: config.influxdb.database, username: config.influxdb.username, password: config.influxdb.password,
    schema: [
      {
        measurement: check_command.command_name,
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
      measurement: check_command.command_name,
      tags: { host: host.name },
      fields: { state:state, message:message }
    }
  ]).catch(err => {
    console.log('Could not save to influxdb');
    console.log(err.stack);
  });
}
