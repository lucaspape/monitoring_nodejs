const send_notification_email = require('./send_notification_email.js');
const send_notification_influxdb = require('./send_notification_influxdb.js');

module.exports = function (config, host, check_command, state, message){
  host.notify.forEach((notify) => {
    switch(notify.how){
      case 'email':
        send_notification_email(config, notify, host, check_command, state, message);
        break;
      case 'influx':
        send_notification_influxdb(config, notify, host, check_command, state, message);
        break;
      default:
        console.log('Cant find notification type ' + notify.how);
    }
  });
}
