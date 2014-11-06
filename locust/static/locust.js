$(window).ready(function() {
    if($("#locust_count").length > 0) {
        $("#locust_count").focus().select();
    }
});

$("#box_stop a").click(function(event) {
    event.preventDefault();
    $.get($(this).attr("href"));
    $("body").attr("class", "stopped");
    $(".box_stop").hide();
    $("a.new_test").show();
    $("a.edit_test").hide();
    $(".user_count").hide();
});

$("#box_reset a").click(function(event) {
    event.preventDefault();
    $.get($(this).attr("href"));
    createResponseChart();
});

$("#new_test").click(function(event) {
    event.preventDefault();
    $("#start").show();
    $("#locust_count").focus().select();
});

$(".edit_test").click(function(event) {
    event.preventDefault();
    $("#edit").show();
    $("#new_locust_count").focus().select();
});

$(".close_link").click(function(event) {
    event.preventDefault();
    $(this).parent().parent().hide();
});


$("#pause_stats").click(function(event) {
    event.preventDefault();
    $("#pause_stats").hide();
    $("#unpause_stats").show();
    pauseStats();
});

$("#unpause_stats").click(function(event) {
    event.preventDefault();
    $("#pause_stats").show();
    $("#unpause_stats").hide();
    unpauseStats();
});

var alternate = false;

$("#status").tabs();

var stats_tpl = $('#stats-template');
var errors_tpl = $('#errors-template');
var exceptions_tpl = $('#exceptions-template');
var all_requests_chart = $('#all_requests');

$('#swarm_form').submit(function(event) {
    event.preventDefault();
    $.post($(this).attr("action"), $(this).serialize(),
        function(response) {
            if (response.success) {
                $("body").attr("class", "hatching");
                $("#start").fadeOut();
                $("#status").fadeIn();
                $(".box_running").fadeIn();
                $("a.new_test").fadeOut();
                $("a.edit_test").fadeIn();
                $(".user_count").fadeIn();
            }
        }
    );
});

$('#edit_form').submit(function(event) {
    event.preventDefault();
    $.post($(this).attr("action"), $(this).serialize(),
        function(response) {
            if (response.success) {
                $("body").attr("class", "hatching");
                $("#edit").fadeOut();
            }
        }
    );
});

var sortBy = function(field, reverse, primer){
    reverse = (reverse) ? -1 : 1;
    return function(a,b){
        a = a[field];
        b = b[field];
       if (typeof(primer) != 'undefined'){
           a = primer(a);
           b = primer(b);
       }
       if (a<b) return reverse * -1;
       if (a>b) return reverse * 1;
       return 0;
    }
}

var pauseStatUpdates = false;

function pauseStats(){
    pauseStatUpdates = true;
}

function unpauseStats(){
    pauseStatUpdates = false;
    updateStats();
    updateResponseChart();
}

// Sorting by column
var sortAttribute = "name";
var desc = false;
var report;
$(".stats_label").click(function(event) {
    event.preventDefault();
    sortAttribute = $(this).attr("data-sortkey");
    desc = !desc;

    $('#stats tbody').empty();
    $('#errors tbody').empty();
    alternate = false;
    totalRow = report.stats.pop()
    sortedStats = (report.stats).sort(sortBy(sortAttribute, desc))
    sortedStats.push(totalRow)
    $('#stats tbody').jqoteapp(stats_tpl, sortedStats);
    alternate = false;
    $('#errors tbody').jqoteapp(errors_tpl, (report.errors).sort(sortBy(sortAttribute, desc)));
});

function updateStats() {
    $.get('/stats/requests', function (data) {
        report = JSON.parse(data);
        $("#total_rps").html(Math.round(report.total_rps*100)/100);
        //$("#fail_ratio").html(Math.round(report.fail_ratio*10000)/100);
        $("#fail_ratio").html(Math.round(report.fail_ratio*100));
        $("#status_text").html(report.state);
        $("#userCount").html(report.user_count);

        if (report.slave_count)
            $("#slaveCount").html(report.slave_count)

        $('#stats tbody').empty();
        $('#errors tbody').empty();

        alternate = false;

        totalRow = report.stats.pop();
        sortedStats = (report.stats).sort(sortBy(sortAttribute, desc));
        sortedStats.push(totalRow);
        $('#stats tbody').jqoteapp(stats_tpl, sortedStats);
        alternate = false;
        $('#errors tbody').jqoteapp(errors_tpl, (report.errors).sort(sortBy(sortAttribute, desc)));

        if (!pauseStatUpdates){
            setTimeout(updateStats, 2000);
        }
    });
}
updateStats();

var latest_timestamp = 0;
var responseChart;
function createResponseChart() {

    var datetime_formatter = function() {
        t = new Date(1970,0,1);
        t.setSeconds(this.value);
        return t.toLocaleTimeString()
    }

    responseChart = new Highcharts.Chart({
            chart: {
                renderTo: 'all_requests',
                type: 'scatter',
            },
            title: {
                text: ''
            },
            plotOptions: {
                scatter: {
                    animation: false,
                    marker: {
                        radius: 5,
                        states: {
                            hover: {
                                enabled: true,
                                lineColor: 'rgb(100,100,100)'
                            }
                        }
                    },
                    states: {
                        hover: {
                            marker: {
                                enabled: false
                            }
                        }
                    },
                    tooltip: {
                        headerFormat: '<b>{series.name}</b><br>',
                        pointFormat: '{point.y} ms,'
                    }
                }
            },
            xAxis: {
                type: "datetime",
                labels: {
                    formatter: datetime_formatter,
                },
                title: {
                    enabled: false,
                },
                startOnTick: false,
                endOnTick: false,
                showLastLabel: false
            },
            yAxis: {
                title: {
                    text: 'Response Time (ms)'
                }
            }
        });
    updateResponseChart();
}


function updateResponseChart() {
    var url = '/stats/responsetimes?timestamp='+latest_timestamp;
    $.get(url, function (data) {
        report = JSON.parse(data);
        if (report.last_timestamp > latest_timestamp) {
            latest_timestamp = report.last_timestamp;
        }
        sortedStats = (report.stats).sort(sortBy(sortAttribute, desc))
        for (i=0; i<sortedStats.length; i++){
            stats_series = responseChart.get(sortedStats[i].method + sortedStats[i].name);
            if (stats_series) {
                for (j=0;j<sortedStats[i].all_responses_with_timestamps.length;j++){
                    stats_series.addPoint(sortedStats[i].all_responses_with_timestamps[j], redraw=false)
                }
            } else {
                responseChart.addSeries({
                    name: sortedStats[i].method + " " + sortedStats[i].name,
                    data: sortedStats[i].all_responses_with_timestamps,
                    id: sortedStats[i].method + sortedStats[i].name,
                }, redraw=false);
            }
        }
        responseChart.redraw();
        responseChart.reflow();
        if (!pauseStatUpdates){
            setTimeout(updateResponseChart, 2000);
        }
    });
}
createResponseChart();

function updateExceptions() {
    $.get('/exceptions', function (data) {
        $('#exceptions tbody').empty();
        $('#exceptions tbody').jqoteapp(exceptions_tpl, data.exceptions);
        setTimeout(updateExceptions, 5000);
    });
}
updateExceptions();