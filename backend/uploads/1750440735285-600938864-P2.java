import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Scanner;
import java.io.ObjectInputStream;

public class P2 {

	public static void main(String[] args) {
		try {
		/* TCP Socket: */
			/*Serveur ==> reçoir */
			ServerSocket ss= new ServerSocket(2001);
			/*Etablir un connexion pour accepter :*/
			Socket con = ss.accept();
			/*Flux d'entree : */
			ObjectInputStream in = new ObjectInputStream(con.getInputStream());
			String N = (String) in.readObject(); /*Reçoir de P1*/
			System.out.println("N reçoir par P1 = "+N);
		/* UDP Socket:  */
			Scanner sc = new Scanner(System.in);
			System.out.println("Donner M >> ");
			String M = sc.next();
			/*Client: Envoyer */
			DatagramSocket c = new DatagramSocket();
			byte[] sendData1 = new byte[40];
			byte[] sendData2 = new byte[40];
			/*Reçcoir les bytes : */
			sendData1 = N.getBytes();
			sendData2 = M.getBytes();
			/*Creation des packets*/
			DatagramPacket p1 = new DatagramPacket(sendData1,sendData1.length,InetAddress.getByName("Localhost"),9876);
			DatagramPacket p2 = new DatagramPacket(sendData2,sendData2.length,InetAddress.getByName("Localhost"),9876);
			/*Envoyer les packets */
			c.send(p1); c.send(p2);
			
			c.close();
			sc.close();
			in.close();
			con.close();
			ss.close();
		}catch (Exception e) {
			System.out.println("Exception : "+e.toString());
		}
	}

}
