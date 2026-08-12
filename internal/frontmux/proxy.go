package frontmux

import (
	"fmt"
	"io"
	"net"
)

func writeProxyV1(writer io.Writer, source, destination net.Addr) error {
	sourceTCP, sourceOK := source.(*net.TCPAddr)
	destinationTCP, destinationOK := destination.(*net.TCPAddr)
	if !sourceOK || !destinationOK {
		_, err := io.WriteString(writer, "PROXY UNKNOWN\r\n")
		return err
	}

	sourceIP := sourceTCP.IP
	destinationIP := destinationTCP.IP
	sourceV4 := sourceIP.To4()
	destinationV4 := destinationIP.To4()
	family := ""
	switch {
	case sourceV4 != nil && destinationV4 != nil:
		family = "TCP4"
		sourceIP = sourceV4
		destinationIP = destinationV4
	case sourceV4 == nil && destinationV4 == nil && sourceIP.To16() != nil && destinationIP.To16() != nil:
		family = "TCP6"
		sourceIP = sourceIP.To16()
		destinationIP = destinationIP.To16()
	default:
		// PROXY v1 cannot represent mixed address families. UNKNOWN is valid
		// and safer than emitting a malformed TCP4/TCP6 line.
		_, err := io.WriteString(writer, "PROXY UNKNOWN\r\n")
		return err
	}

	_, err := fmt.Fprintf(
		writer,
		"PROXY %s %s %s %d %d\r\n",
		family,
		sourceIP.String(),
		destinationIP.String(),
		sourceTCP.Port,
		destinationTCP.Port,
	)
	return err
}
