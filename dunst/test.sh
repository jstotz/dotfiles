INTERVAL=2

test_notify() {
    notify-send "Test $1" 'Link: <a href="https://example.com">Click Me</a><br>Another line.' -t $(expr $INTERVAL \* 1000) -u $1
}

while true; do
    killall dunst
    test_notify low
    test_notify normal
    test_notify critical
    sleep $INTERVAL
done
