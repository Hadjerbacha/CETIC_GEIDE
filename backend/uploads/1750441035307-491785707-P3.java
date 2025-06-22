import java.io.ObjectOutputStream; 
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Socket;

public class P3 {
	static boolean  Amicaux (int a,int b) {
		/* N et M sont amicaux : sum(div de M = N) et sum(div de N = M)  */
		int S1=0;
		for (int i=1;i<=a/2;i++) {
			if (a % i == 0) {
				S1=S1+i;
			}
		}
		int S2=0;
		for (int i=1;i<=b/2;i++) {
			if (b % i == 0) {
				S2=S2+i;
			}
		}
		if (S1==b && S2==a) { 
			return true;
		} else return false; 
		
	}

	public static void main(String[] args) {
		try {
		/*UDP Socket :*/
			/*Server: */
			DatagramSocket c = new DatagramSocket(9876);
			/*Reception des packets :*/
			/*Cree tableau des bytes et q packet pour mettre les packet reçu*/
			byte[] receiveData = new byte [40];
			DatagramPacket q= new DatagramPacket(receiveData,receiveData.length);
			/*On reçois N puis M , on peut utiliser le meme packet */
			c.receive(q);
			String N = new String(q.getData(), 0, q.getLength()).trim();
			//String N = new String(q.getData()).trim(); 
			/*trim c'est pour garantit que les données reçues sont propres et sans espaces blancs parasites*/
			c.receive(q);
			String M = new String(q.getData(), 0, q.getLength()).trim();
			//String M = new String(q.getData()).trim();
			System.out.println("N reçoir par P2 = "+N);
			System.out.println("M reçoir par P2 = "+M);
			int Sum = Integer.parseInt(N) + Integer.parseInt(M); 
			System.out.println("Sum N + M = "+Sum); 
			
			int N1 = Integer.parseInt(N); int M1 = Integer.parseInt(M);
			String rep = (String.valueOf(Amicaux(N1,M1)));
			if (Amicaux(N1,M1)== true) {
				System.out.println(N1+ " et " +M1+" sont amicaux "); 			
			}else System.out.println(N1+ " et " +M1+" ne sont pas amicaux "); 
			
			/*TCP Socket :*/
			/*L'envoyer : client */
			Socket c2 = new Socket("localhost",2002); /*Client de P4*/
			/* Creation des flux d'information : */
			ObjectOutputStream out = new ObjectOutputStream(c2.getOutputStream());
			out.writeObject(N);out.writeObject(M);out.writeObject(rep);
			
			
			out.close();
			c2.close();
			c.close();
			
			
		}catch (Exception e) {
			System.out.println("Exception : "+e.toString());
		}
	}

}
